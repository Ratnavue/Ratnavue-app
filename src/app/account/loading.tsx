// Catches the moment BEFORE the account hub layout itself has rendered —
// (hub)/layout.tsx awaits the sidebar's counts and the account-standing check,
// and its own (hub)/loading.tsx only covers the page *inside* that layout.
// Without this file, entering the account area from the storefront fell
// through to the root loading.tsx (the full-screen branded PageLoader) and
// then switched to the hub's skeleton: two different loading screens for a
// single click. This renders the same skeleton shape as the hub layout, so
// the hand-off to the real sidebar + (hub)/loading.tsx is seamless.
export default function AccountAreaLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="mx-auto max-w-6xl animate-pulse px-4 py-8 sm:px-6 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8 lg:py-12"
    >
      <div className="hidden space-y-3 rounded-2xl border border-border-subtle bg-surface p-5 lg:block">
        <div className="h-4 w-2/3 rounded bg-ivory-soft" />
        <div className="h-3 w-1/2 rounded bg-ivory-soft" />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-8 rounded-lg bg-ivory-soft" />
        ))}
      </div>
      <div>
        <div className="h-3 w-40 rounded bg-ivory-soft" />
        <div className="mt-6 h-8 w-64 rounded bg-ivory-soft" />
        <div className="mt-8 space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="rounded-xl border border-border-subtle bg-surface p-5">
              <div className="h-4 w-1/3 rounded bg-ivory-soft" />
              <div className="mt-3 h-3 w-2/3 rounded bg-ivory-soft" />
              <div className="mt-2 h-3 w-1/2 rounded bg-ivory-soft" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
