import type { Metadata } from "next";
import { MilaChat } from "./mila-chat";

export const metadata: Metadata = { title: "Mila" };

export default function MilaPage() {
  return <MilaChat />;
}
