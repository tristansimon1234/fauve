import { PageSuspense } from "@/components/page-suspense";
import type { Metadata } from "next";
import { z } from "zod";
import { NoStudio } from "@/components/empty-state";
import { localDateOf, weekOf } from "@/lib/dates";
import { plural } from "@/lib/format";
import { creditBalance } from "@/lib/credits";
import { whatsappLink } from "@/lib/public-env";
import { getStudioContext, rows } from "@/lib/studio";
import { listConversations, loadConversation } from "./chat-actions";
import { FauveWorkspace, type Suggestion } from "./fauve-workspace";
import { onboardingView } from "./onboarding-actions";
import { ChatLoading } from "./chat-loading";

export const metadata: Metadata = { title: "Edith" };
// The chat runs Fauve (and may queue a montage) inside a server action.
export const maxDuration = 300;

export default function FauvePage({ searchParams }: PageProps<"/fauve">) {
  return (
    // Full height: the composer stays at the bottom, the space left between the header and the
    // phone's tab bar (data-fill, app-shell.tsx); measured by hand (100dvh − 134 px), it was taller
    // than the space on a phone and the composer slid under the tab bar on a small one.
    <main data-fill className="flex min-h-[320px] flex-1 flex-col">
      <PageSuspense title="Edith" skeleton={<ChatLoading />}>
        <Home searchParams={searchParams} />
      </PageSuspense>
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

  const [drafts, weekPosts, conversations, credits] = await Promise.all([
    db.from("posts").select("id", { count: "exact", head: true }).eq("studio_id", studioId).eq("status", "draft"),
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
  const thisWeek = rows(z.object({ status: z.string() }), weekPosts, "posts");
  const published = thisWeek.filter((p) => p.status === "published" || p.status === "measured").length;
  const summary = [
    thisWeek.length
      ? `Cette semaine : ${plural(thisWeek.length, "publication prévue", "publications prévues")}, ${plural(published, "publiée", "publiées")}.`
      : "Rien n’est encore prévu cette semaine.",
    toValidate ? `${plural(toValidate, "brouillon attend", "brouillons attendent")} ta validation.` : "",
    `Il te reste ${plural(credits, "crédit", "crédits")}.`,
  ]
    .filter(Boolean)
    .join(" ");

  // Three ways in: make something, see how it went, an idea from what she has.
  const suggestions: Suggestion[] = [
    { icon: "plus", label: "Créer une publication", hint: "Reel, carrousel, photo ou story", action: "new-post" },
    { icon: "chart", label: "Voir mes derniers résultats", hint: "Ce qui a marché, et pourquoi", prompt: "Comment ont marché mes dernières publications ? Dis-moi ce qui a le mieux marché et pourquoi." },
    {
      icon: "check",
      label: "Une idée pour cette semaine",
      hint: toValidate ? `${plural(toValidate, "publication attend", "publications attendent")} ta validation` : "Avec ce que tu as déjà",
      prompt: "Tu aurais une idée de publication pour cette semaine, avec ce que j’ai déjà ?",
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
