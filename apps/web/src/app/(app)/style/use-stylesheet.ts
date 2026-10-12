"use client";

import { useEffect, useSyncExternalStore } from "react";

// Google Fonts stylesheets added to <head> once per URL, with their load status
// (a family that does not exist on Google Fonts answers 400 and fires "error").

export type SheetStatus = "loading" | "loaded" | "error";

const statuses = new Map<string, SheetStatus>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load(href: string) {
  if (statuses.has(href)) return;
  statuses.set(href, "loading");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.onload = () => {
    statuses.set(href, "loaded");
    emit();
  };
  link.onerror = () => {
    statuses.set(href, "error");
    emit();
  };
  document.head.appendChild(link);
}

/** Loads one stylesheet and returns its status (null without href). */
export function useStylesheet(href: string | null): SheetStatus | null {
  useEffect(() => {
    if (href) load(href);
  }, [href]);
  return useSyncExternalStore(
    subscribe,
    () => (href ? (statuses.get(href) ?? "loading") : null),
    () => (href ? "loading" : null),
  );
}

/** Loads several stylesheets (the font pickers' samples). */
export function useStylesheets(hrefs: string[]) {
  const key = hrefs.join("\n");
  useEffect(() => {
    for (const href of key.split("\n")) if (href) load(href);
  }, [key]);
}
