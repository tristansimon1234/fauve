import { Children, type ReactNode } from "react";

/** French typography on the landing's words: a non-breaking space before « : ; ! ? » and inside guillemets, so none starts a line alone. */
export const fr = (text: string) => text.replace(/ ([:;!?»])/g, " $1").replace(/« /g, "« ");

/** The same on a title's words, its emphasised spans left as they are. */
export const frNodes = (nodes: ReactNode) => Children.map(nodes, (node) => (typeof node === "string" ? fr(node) : node));
