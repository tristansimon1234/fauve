import { Suspense, ViewTransition } from "react";
import { PageLoading } from "./empty-state";

/**
 * A page's content behind its loading skeleton: the skeleton fades out quickly,
 * then the page rises in gently (React view transitions; no animation where the
 * browser lacks them or when reduced motion is asked).
 */
export function PageSuspense({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <ViewTransition exit="fauve-loading-out" default="none">
          <PageLoading title={title} />
        </ViewTransition>
      }
    >
      <ViewTransition enter="fauve-reveal" default="none">
        {children}
      </ViewTransition>
    </Suspense>
  );
}
