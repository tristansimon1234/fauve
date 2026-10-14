import { ViewTransition } from "react";

// Every page of the app comes in with a short fade and a slight rise, and the
// one it replaces fades out quickly; the menu stays still. A week change in the
// calendar has its own slide, so the page itself does not move then.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const calendar = { "week-next": "none", "week-prev": "none", "week-today": "none" } as const;
  return (
    <ViewTransition enter={{ ...calendar, default: "fauve-page-in" }} exit={{ ...calendar, default: "fauve-page-out" }} default="none">
      {children}
    </ViewTransition>
  );
}
