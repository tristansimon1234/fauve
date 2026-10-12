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
