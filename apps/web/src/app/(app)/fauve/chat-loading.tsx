/**
 * The chat's loading skeleton, in its own shape: the conversations on the left (computer), Edith's
 * place at the top, the composer at the bottom. The pages' skeleton (a big title and cards) showed
 * an old « Bonjour » stuck in the corner before the chat appeared (Tristan: « un vieux bonjour se met
 * dans le coin »).
 */
export function ChatLoading() {
  return (
    <div className="flex min-h-0 flex-1" aria-busy="true" aria-label="Chargement de la conversation">
      <aside className="hidden w-[272px] shrink-0 flex-col gap-2 border-r border-line bg-white px-5 pt-6 md:flex">
        <div className="mb-3 h-4 w-28 rounded-full bg-soft" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-[12px] bg-soft motion-reduce:animate-none" />
        ))}
      </aside>
      <section className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(ellipse_at_top_right,#efebff_0%,rgba(239,235,255,0)_55%),radial-gradient(ellipse_at_bottom_left,#fff1ec_0%,rgba(255,241,236,0)_50%)]">
        <div className="flex items-center gap-2.5 px-4 pt-3 sm:px-6 sm:pt-4">
          <div className="size-11 animate-pulse rounded-full bg-white/80 motion-reduce:animate-none sm:size-[60px]" />
          <div className="flex flex-col gap-1.5">
            <div className="h-3.5 w-14 rounded-full bg-white/80" />
            <div className="h-3 w-32 rounded-full bg-white/60" />
          </div>
        </div>
        <div className="flex-1" />
        <div className="px-4 pt-2 pb-4 sm:px-6 sm:pb-6">
          <div className="mx-auto h-[62px] w-full max-w-[820px] rounded-[30px] border border-line bg-white shadow-[0_8px_30px_rgba(28,21,48,0.08)]" />
        </div>
      </section>
    </div>
  );
}
