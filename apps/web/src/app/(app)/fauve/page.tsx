import type { Metadata } from "next";
import { FauveChat } from "./fauve-chat";

export const metadata: Metadata = { title: "Fauve" };

export default function FauvePage() {
  return <FauveChat />;
}
