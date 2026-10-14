import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { NoStudio, PageLoading } from "@/components/empty-state";
import { localDateOf, weekOf } from "@/lib/dates";
import { plural } from "@/lib/format";
import { creditBalance } from "@/lib/credits";
import { whatsappLink } from "@/lib/public-env";
import { getStudioContext, rows } from "@/lib/studio";
import { listConversations, loadConversation } from "./chat-actions";
import { FauveWorkspace, type Suggestion } from "./fauve-workspace";
import { onboardingView } from "./onboarding-actions";

export const metadata: Metadata = { title: "Fauve" };
// The chat runs Fauve (and may queue a montage) inside a server action.
export const maxDuration = 300;

export default function FauvePage({ searchParams }: PageProps<"/fauve">) {
  return (
    // Full height: the composer stays at the bottom (phone: minus the header and the tab bar).
    <main className="flex h-[calc(100dvh-134px)] min-h-[480px] flex-col lg:h-dvh">
      <Suspense fallback={<PageLoading title="Bonjour" />}>
        <Home searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Home({ searchParams }: { searchParams: PageProps<"/fauve">["searchParams"] }) {
  const { db, member } = await getStudioContext();
  if (!member) {
    return (
      <div className="px-4 pt-6 sm:px-10">
        <NoStudio />
      </div>
    );
  }
  const studioId = member.studio.id;
  const tz = member.studio.timezone;
  const week = weekOf(localDateOf(new Date(), tz), tz);
  const requested = (await searchParams).c;

  const [drafts, shots, weekPosts, conversations, credits] = await Promise.all([
    db.from("posts").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("status", "draft"),
    db.from("shot_requests").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("done", false),
    db
      .from("posts")
      .select("status")
      .eq("studio_id", studioId)
      .neq("status", "skipped")
      .gte("scheduled_at", week.start.toISOString())
      .lt("scheduled_at", week.end.toISOString()),
    listConversations(),
    creditBalance(studioId),
  ]);
  const onboarding = await onboardingView();
  const active = typeof requested === "string" && conversations.some((c) => c.id === requested) ? requested : null;
  const messages = active ? ((await loadConversation(active)) ?? []) : [];

  const toValidate = drafts.count ?? 0;
  const toFilm = shots.count ?? 0;
  const thisWeek = rows(z.object({ status: z.string() }), weekPosts, "posts");
  const published = thisWeek.filter((p) => p.status === "published" || p.status === "measured").length;
  const summary = [
    thisWeek.length
      ? `Cette semaine : ${plural(thisWeek.length, "publication prévue", "publications prévues")}, ${plural(published, "publiée", "publiées")}.`
      : "Rien n’est encore prévu cette semaine.",
    toValidate ? `${plural(toValidate, "brouillon attend", "brouillons attendent")} ta validation.` : "",
    toFilm ? `${plural(toFilm, "plan", "plans")} à filmer.` : "",
    `Il te reste ${plural(credits, "crédit", "crédits")}.`,
  ]
    .filter(Boolean)
    .join(" ");

  // Three ways in: make something, see how it went, see what is waiting.
  const tasks = [toValidate ? `${plural(toValidate, "à valider", "à valider")}` : "", toFilm ? `${plural(toFilm, "plan à filmer", "plans à filmer")}` : ""].filter(Boolean);
  const suggestions: Suggestion[] = [
    { icon: "plus", label: "Créer une publication", hint: "Reel, carrousel, photo ou story", action: "new-post" },
    { icon: "chart", label: "Voir mes derniers résultats", hint: "Ce qui a marché, et pourquoi", prompt: "Comment ont marché mes dernières publications ? Dis-moi ce qui a le mieux marché et pourquoi." },
    {
      icon: "check",
      label: "Voir ce qui m’attend",
      hint: tasks.length ? tasks.join(" · ") : "Rien d’urgent pour l’instant",
      prompt: "Qu’est-ce qui m’attend ? Ce que je dois valider, filmer ou t’envoyer, du plus urgent au moins urgent.",
    },
  ];

  return (
    <FauveWorkspace
      studioId={studioId}
      firstName={member.first_name ?? null}
      summary={summary}
      suggestions={suggestions}
      whatsappHref={whatsappLink()}
      timezone={tz}
      initialConversations={conversations}
      initialActive={active}
      initialMessages={messages}
      onboarding={onboarding?.step === "done" ? null : onboarding}
    />
  );
}
