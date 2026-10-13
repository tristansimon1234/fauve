import { redirect } from "next/navigation";

// The grid is a view of the calendar now.
export default function GridPage() {
  redirect("/calendrier?vue=grille");
}
