// Pages opened from WhatsApp: built for the phone, centered on desktop.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-soft sm:flex sm:items-center sm:justify-center sm:py-10">
      <div className="flex min-h-dvh w-full flex-col bg-white sm:min-h-[760px] sm:max-w-[420px] sm:overflow-hidden sm:rounded-[36px] sm:shadow-[0_24px_60px_rgba(28,21,48,.10)]">
        {children}
      </div>
    </div>
  );
}
