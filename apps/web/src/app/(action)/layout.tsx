// Pages opened from a WhatsApp link: one action, full screen, no app menu.
export default function ActionLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-ink text-white">{children}</div>;
}
