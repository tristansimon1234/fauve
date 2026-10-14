import "server-only";
import { createHash } from "node:crypto";

/**
 * A short key that changes when the data changes: given to an editor that keeps
 * its own copy of the data, it starts over from the server's version when Fauve
 * (or another screen) changed it, and stays as it is after a refresh that changed nothing.
 */
export function versionKey(...values: unknown[]): string {
  return createHash("sha1").update(JSON.stringify(values)).digest("hex").slice(0, 12);
}
