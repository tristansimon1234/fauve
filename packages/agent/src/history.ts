// Fauve answers a burst of messages after a short pause, so a new message can land
// while she is still writing. Stored by time, her reply would then come after a
// message she never saw, and the conversation would end on her turn. Each reply
// records the message it answers (reply_to) and is put back right after it.

export type OrderableMessage = {
  direction: "inbound" | "outbound";
  wa_message_id: string | null;
  reply_to?: string | null;
};

export function orderReplies<T extends OrderableMessage>(rows: T[]): T[] {
  const ordered: T[] = [];
  for (const row of rows) {
    const target =
      row.direction === "outbound" && row.reply_to
        ? ordered.findIndex((r) => r.direction === "inbound" && r.wa_message_id === row.reply_to)
        : -1;
    if (target === -1) {
      ordered.push(row);
      continue;
    }
    let at = target + 1;
    while (ordered[at]?.direction === "outbound") at++;
    ordered.splice(at, 0, row);
  }
  return ordered;
}

/**
 * The recent messages the model sees, at least `limit` of them, starting on a
 * checkpoint (a message whose id falls on 1 in `step`): the start stays put
 * while new messages come in and jumps ahead about every `step` messages. A
 * window sliding by one message each turn would change the start of the
 * history every time, and the whole history would be written to the prompt
 * cache again on each message instead of read from it.
 */
export function stableWindow<T extends { id: string }>(chronological: T[], limit: number, step: number): T[] {
  const isCheckpoint = (id: string) => parseInt(id.replace(/-/g, "").slice(0, 8), 16) % step === 0;
  for (let i = chronological.length - limit; i >= 0; i--) {
    if (isCheckpoint(chronological[i]!.id)) return chronological.slice(i);
  }
  // No checkpoint in reach: the newest ones, a step's worth beyond the limit.
  return chronological.slice(-(limit + step));
}
