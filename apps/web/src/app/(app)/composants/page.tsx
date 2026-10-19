import { redirect } from "next/navigation";

// « Tes créations » is part of « Ton style » now: its animations and text styles are at the end
// of that page; the components for photos gave way to the carousels Simone composes.
export default function CreationsPage() {
  redirect("/style");
}
