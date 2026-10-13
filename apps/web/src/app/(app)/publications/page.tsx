import { redirect } from "next/navigation";

// Publications live in the calendar (week, grid, ideas without a date); each one keeps its page.
export default function PostsPage() {
  redirect("/calendrier");
}
