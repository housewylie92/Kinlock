import { InterlockMark } from "./InterlockMark";

export function AuthLayout({
  children,
  eyebrow,
}: {
  children: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel — hidden on small screens, the visual thesis on larger ones */}
      <div className="hidden lg:flex lg:w-[42%] flex-col justify-between bg-indigo px-12 py-14 text-paper">
        <div className="flex items-center gap-3">
          <InterlockMark size={40} />
          <span className="font-display text-xl tracking-tight">Kinlock</span>
        </div>

        <div>
          <InterlockMark size={120} animated className="mb-10" />
          <h1 className="font-display text-4xl leading-[1.15] mb-4">
            The family calendar
            <br />
            that actually stays
            <br />
            in sync.
          </h1>
          <p className="text-paper/70 max-w-sm leading-relaxed">
            Real two-way sync, permissions that hold, and a free tier that
            stays free. No surprise paywalls, ever — that&rsquo;s a promise,
            not a feature.
          </p>
        </div>

        <p className="text-sm text-paper/50">
          Built for the families who outgrew Cozi.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col justify-center px-6 sm:px-12 lg:px-20 py-14 bg-paper">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <InterlockMark size={32} />
            <span className="font-display text-lg text-ink">Kinlock</span>
          </div>
          {eyebrow && (
            <p className="font-mono text-xs tracking-widest uppercase text-teal mb-2">
              {eyebrow}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
