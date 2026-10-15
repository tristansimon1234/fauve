import { redirect } from "next/navigation";

// No calendar in the app any more (she does not plan, Simone does): the grid
// shows what is coming. Old links land there.
export default function CalendarPage() {
  redirect("/grille");
}
